Add-Type -AssemblyName System.Drawing

function New-SaunaIcon {
  param(
    [int]$Size,
    [string]$OutPath,
    [double]$Padding = 0.14
  )
  $bmp = [System.Drawing.Bitmap]::new($Size, $Size)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.Clear([System.Drawing.Color]::FromArgb(255, 0xC1, 0x55, 0x2C))

  $pad = [int]($Size * $Padding)
  $inner = $Size - ($pad * 2)

  # water bath (bottom teal ellipse)
  $waterColor = [System.Drawing.Color]::FromArgb(255, 0x3D, 0x7A, 0x6E)
  $waterBrush = [System.Drawing.SolidBrush]::new($waterColor)
  $waterRect = [System.Drawing.RectangleF]::new([single]$pad, [single]($Size * 0.60), [single]$inner, [single]($inner * 0.30))
  $g.FillEllipse($waterBrush, $waterRect)

  # sauna stone (white circle)
  $stoneBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
  $stoneSize = $inner * 0.34
  $stoneRect = [System.Drawing.RectangleF]::new([single](($Size - $stoneSize) / 2), [single]($Size * 0.42), [single]$stoneSize, [single]$stoneSize)
  $g.FillEllipse($stoneBrush, $stoneRect)

  # steam curls (x3 white bezier curves)
  $penWidth = [single]([Math]::Max(2, $Size * 0.025))
  $steamPen = [System.Drawing.Pen]::new([System.Drawing.Color]::White, $penWidth)
  $steamPen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $steamPen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $steamY = $Size * 0.10
  $steamW = $inner * 0.16
  $offsets = @(-1, 0, 1)
  foreach ($o in $offsets) {
    $cx = ($Size / 2) + ($o * $steamW * 1.4)
    $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $path.AddBezier(
      [single]$cx, [single]($steamY + ($Size * 0.22)),
      [single]($cx - $steamW), [single]($steamY + ($Size * 0.12)),
      [single]($cx + $steamW), [single]($steamY + ($Size * 0.02)),
      [single]$cx, [single]$steamY
    )
    $g.DrawPath($steamPen, $path)
  }

  $bmp.Save($OutPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose()
  $bmp.Dispose()
}

$root = $PSScriptRoot
New-SaunaIcon -Size 192 -OutPath (Join-Path $root "icon-192.png") -Padding 0.16
New-SaunaIcon -Size 512 -OutPath (Join-Path $root "icon-512.png") -Padding 0.16
New-SaunaIcon -Size 512 -OutPath (Join-Path $root "icon-maskable-512.png") -Padding 0.24
Write-Host "Icons generated."
