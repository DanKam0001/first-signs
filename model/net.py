"""Compact isolated-sign classifier: input (B, T, F) features from preprocess, output (B, C) logits.

Conv1D blocks for local motion + a small transformer for whole-sign context. Attention is written
with plain matmuls so the ONNX graph only uses ops every onnxruntime-web build supports.
"""
import math

import torch
from torch import nn


class ConvBlock(nn.Module):
    def __init__(self, d, k=5, drop=0.1):
        super().__init__()
        self.norm = nn.LayerNorm(d)
        self.pw1 = nn.Linear(d, 2 * d)
        self.dw = nn.Conv1d(d, d, k, padding=k // 2, groups=d)
        self.bn = nn.BatchNorm1d(d)
        self.pw2 = nn.Linear(d, d)
        self.drop = nn.Dropout(drop)

    def forward(self, x):  # (B,T,d)
        h = self.norm(x)
        a, g = self.pw1(h).chunk(2, dim=-1)
        h = a * torch.sigmoid(g)  # GLU
        h = self.dw(h.transpose(1, 2))
        h = torch.nn.functional.silu(self.bn(h)).transpose(1, 2)
        return x + self.drop(self.pw2(h))


class Attention(nn.Module):
    def __init__(self, d, heads=4, drop=0.1):
        super().__init__()
        self.h = heads
        self.dk = d // heads
        self.qkv = nn.Linear(d, 3 * d)
        self.out = nn.Linear(d, d)
        self.drop = nn.Dropout(drop)

    def forward(self, x):
        B, T, D = x.shape
        q, k, v = self.qkv(x).reshape(B, T, 3, self.h, self.dk).permute(2, 0, 3, 1, 4)
        att = torch.softmax(torch.matmul(q, k.transpose(-1, -2)) / math.sqrt(self.dk), dim=-1)
        y = torch.matmul(self.drop(att), v).transpose(1, 2).reshape(B, T, D)
        return self.out(y)


class TxBlock(nn.Module):
    def __init__(self, d, heads=4, drop=0.1):
        super().__init__()
        self.n1 = nn.LayerNorm(d)
        self.att = Attention(d, heads, drop)
        self.n2 = nn.LayerNorm(d)
        self.ff = nn.Sequential(nn.Linear(d, 2 * d), nn.GELU(), nn.Dropout(drop), nn.Linear(2 * d, d))
        self.drop = nn.Dropout(drop)

    def forward(self, x):
        x = x + self.drop(self.att(self.n1(x)))
        return x + self.drop(self.ff(self.n2(x)))


class SignNet(nn.Module):
    def __init__(self, T, F, C, d=192, n_conv=3, n_tx=2, drop=0.2):
        super().__init__()
        self.inp = nn.Sequential(nn.Linear(F, d), nn.LayerNorm(d))
        self.pos = nn.Parameter(torch.zeros(1, T, d))
        blocks = []
        for i in range(max(n_conv, n_tx)):
            if i < n_conv:
                blocks.append(ConvBlock(d, drop=drop / 2))
            if i < n_tx:
                blocks.append(TxBlock(d, drop=drop / 2))
        self.blocks = nn.Sequential(*blocks)
        self.norm = nn.LayerNorm(d)
        self.drop = nn.Dropout(drop)
        self.head = nn.Linear(2 * d, C)

    def forward(self, x):
        h = self.inp(x) + self.pos
        h = self.norm(self.blocks(h))
        pooled = torch.cat([h.mean(dim=1), h.amax(dim=1)], dim=-1)
        return self.head(self.drop(pooled))
