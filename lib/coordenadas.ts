// Coordenadas digitadas à mão ou lidas da foto (EXIF).
// Aceita: "-3.355600, -64.707700" · "-3,3556; -64,7077" · "3°21'20.2\"S 64°42'27.7\"W" (W ou O = oeste)

export type Coord = { lat: number; lng: number };

const valida = (c: Coord | null): Coord | null =>
  c && Number.isFinite(c.lat) && Number.isFinite(c.lng) && Math.abs(c.lat) <= 90 && Math.abs(c.lng) <= 180 && !(c.lat === 0 && c.lng === 0) ? c : null;

function grausParaDecimal(g: string, m: string, s: string, hemi: string): number {
  const v = Number(g) + Number(m || 0) / 60 + Number(String(s || 0).replace(',', '.')) / 3600;
  return /[SWO]/i.test(hemi) ? -v : v;
}

export function lerCoordenadas(texto: string): Coord | null {
  const t = texto.trim().replace(/[’']{2}/g, '"');
  if (!t) return null;
  // graus, minutos, segundos
  const dms = [...t.matchAll(/(\d{1,3})\s*[°º]\s*(\d{1,2})?\s*['′]?\s*([\d.,]+)?\s*["″]?\s*([NSLOWE])/gi)];
  if (dms.length === 2) {
    const a = grausParaDecimal(dms[0][1], dms[0][2], dms[0][3], dms[0][4]);
    const b = grausParaDecimal(dms[1][1], dms[1][2], dms[1][3], dms[1][4]);
    const latPrimeiro = /[NS]/i.test(dms[0][4]);
    return valida(latPrimeiro ? { lat: a, lng: b } : { lat: b, lng: a });
  }
  // decimal: com ";" a vírgula pode ser decimal; sem ";" a vírgula separa os dois números
  const partes = t.includes(';')
    ? t.split(';').map(p => p.trim().replace(',', '.'))
    : t.split(/[,\s]+/).filter(Boolean);
  if (partes.length !== 2) return null;
  const [lat, lng] = partes.map(Number);
  return valida({ lat, lng });
}

// Tefé e o interior do Amazonas ficam ao sul e a oeste: os dois números são negativos.
// Se vierem os dois positivos nessa faixa, provavelmente faltou o sinal de menos.
export const faltouSinal = (c: Coord) => c.lat > 0 && c.lat < 12 && c.lng > 55 && c.lng < 75;

export const formatar = (c: Coord) => `${c.lat.toFixed(6)}, ${c.lng.toFixed(6)}`;

// EXIF da foto: o Android/iOS pode entregar número decimal, texto "3/1,21/1,2045/100" ou lista
function exifParaNumero(v: any): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  const pedacos = Array.isArray(v) ? v : String(v).split(',');
  const nums = pedacos.map((p: any) => {
    if (typeof p === 'number') return p;
    const [a, b] = String(p).split('/').map(Number);
    return b ? a / b : a;
  });
  if (nums.some((n: number) => !Number.isFinite(n))) return null;
  return (nums[0] || 0) + (nums[1] || 0) / 60 + (nums[2] || 0) / 3600;
}

export function coordDoExif(exif: Record<string, any> | null | undefined): Coord | null {
  if (!exif) return null;
  const lat = exifParaNumero(exif.GPSLatitude ?? exif['{GPS}']?.Latitude);
  const lng = exifParaNumero(exif.GPSLongitude ?? exif['{GPS}']?.Longitude);
  if (lat == null || lng == null) return null;
  const refLat = String(exif.GPSLatitudeRef ?? exif['{GPS}']?.LatitudeRef ?? '');
  const refLng = String(exif.GPSLongitudeRef ?? exif['{GPS}']?.LongitudeRef ?? '');
  return valida({
    lat: /S/i.test(refLat) ? -Math.abs(lat) : lat,
    lng: /W/i.test(refLng) ? -Math.abs(lng) : lng,
  });
}
