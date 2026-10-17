"""Export the trained model to model/export/model.onnx and check it against PyTorch.

  python model/export_onnx.py --ckpt D:/datasets/gislr/runs/final/model_all.pt

Input  `features` float32[1, T, F]  (preprocess.js toFeatures, reshaped)
Output `logits`   float32[1, C]     (order = labels.json = signs.json "signs" order)
Opset 17 (LayerNormalization is native there); onnxruntime-web 1.20 supports it on the wasm backend.
"""
import argparse
import json
import os
import sys

import numpy as np
import torch

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
from net import SignNet  # noqa: E402
from preprocess import F, T  # noqa: E402

EXPORT = os.path.join(HERE, "export")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ckpt", required=True)
    ap.add_argument("--out", default=os.path.join(EXPORT, "model.onnx"))
    ap.add_argument("--opset", type=int, default=17)
    a = ap.parse_args()
    ck = torch.load(a.ckpt, map_location="cpu", weights_only=False)
    cfg = ck["cfg"]
    model = SignNet(T, F, len(cfg["labels"]), d=cfg["dim"], n_conv=cfg["conv"], n_tx=cfg["tx"], drop=cfg["drop"])
    model.load_state_dict(ck["state"])
    model.eval()
    x = torch.randn(1, T, F)
    torch.onnx.export(model, (x,), a.out, input_names=["features"], output_names=["logits"], opset_version=a.opset,
                      dynamo=False, do_constant_folding=True)
    json.dump({"labels": cfg["labels"], "T": T, "F": F, "input": "features", "output": "logits"},
              open(os.path.join(os.path.dirname(a.out), "labels.json"), "w"), indent=1)

    import onnx
    import onnxruntime as ort

    onnx.checker.check_model(onnx.load(a.out))
    sess = ort.InferenceSession(a.out, providers=["CPUExecutionProvider"])
    rng = np.random.default_rng(0)
    worst = 0.0
    fixtures = []
    for i in range(8):
        xi = rng.normal(0, 1, (1, T, F)).astype(np.float32)
        if i % 2:
            xi[:, :, F // 2:] = 0  # missing-hand style inputs
        fixtures.append(xi)
    for xi in fixtures:
        with torch.no_grad():
            pt = model(torch.from_numpy(xi)).numpy()
        on = sess.run(["logits"], {"features": xi})[0]
        worst = max(worst, float(np.abs(pt - on).max()))
    size = os.path.getsize(a.out) / 1e6
    print(f"wrote {a.out} ({size:.2f} MB, opset {a.opset}); max |torch - onnxruntime| = {worst:.2e}")
    assert worst < 1e-3, worst
    # end-to-end fixture for tests/ort_web_check.mjs: refs -> preprocess -> logits (PyTorch)
    from preprocess import to_features
    cases = {"random": {"input": fixtures[0].reshape(-1).tolist()}}
    with torch.no_grad():
        cases["random"]["logits"] = model(torch.from_numpy(fixtures[0])).numpy().reshape(-1).tolist()
        for s in cfg["labels"][:5]:
            rp = os.path.join(EXPORT, "refs", f"{s}.json")
            if os.path.exists(rp):
                fr = json.load(open(rp))["frames"]
                xi = to_features(fr).reshape(1, T, F)
                cases["ref_" + s] = {"ref": s, "logits": model(torch.from_numpy(xi)).numpy().reshape(-1).tolist()}
    json.dump(cases, open(os.path.join(HERE, "tests", "onnx_check.json"), "w"))


if __name__ == "__main__":
    main()
