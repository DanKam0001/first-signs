# Capture the WSLg "Vega Virtual Device" window via PrintWindow. Usage: powershell -File winshot.ps1 <out.png>
param([string]$Out)
Add-Type -AssemblyName System.Drawing
Add-Type @"
using System; using System.Runtime.InteropServices; using System.Text;
public class W {
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc f, IntPtr l);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr h, IntPtr dc, uint f);
  public struct RECT { public int L, T, R, B; }
}
"@
$found = [IntPtr]::Zero
$cb = [W+EnumProc]{ param($h,$l) $sb = New-Object System.Text.StringBuilder 256; [W]::GetWindowText($h,$sb,256) | Out-Null
  if ([W]::IsWindowVisible($h) -and $sb.ToString() -like "*Vega Virtual Device*") { $script:found = $h; return $false }; return $true }
[W]::EnumWindows($cb, [IntPtr]::Zero) | Out-Null
if ($found -eq [IntPtr]::Zero) { "no window"; exit 1 }
$r = New-Object W+RECT; [W]::GetWindowRect($found, [ref]$r) | Out-Null
$bmp = New-Object System.Drawing.Bitmap ($r.R - $r.L), ($r.B - $r.T)
$g = [System.Drawing.Graphics]::FromImage($bmp); $dc = $g.GetHdc(); [W]::PrintWindow($found, $dc, 2) | Out-Null; $g.ReleaseHdc($dc)
$bmp.Save($Out); "$Out $($bmp.Width)x$($bmp.Height)"
