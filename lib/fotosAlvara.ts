import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import type { FotoAlvara } from './sadApi';

export const MAX_FOTOS_ALVARA = 4;

// Copia a foto para a pasta permanente do app (a pasta de cache pode ser limpa pelo Android)
async function guardar(uri: string): Promise<string> {
  const pasta = `${FileSystem.documentDirectory}fotos_alvara/`;
  await FileSystem.makeDirectoryAsync(pasta, { intermediates: true }).catch(() => {});
  const destino = `${pasta}${Date.now()}_${Math.round(Math.random() * 1e6)}.jpg`;
  await FileSystem.copyAsync({ from: uri, to: destino });
  return destino;
}

// origem: 'camera' ou 'galeria'. Devolve a foto pronta para entrar no formulário, ou null se cancelou.
export async function escolherFotoAlvara(origem: 'camera' | 'galeria'): Promise<FotoAlvara | null> {
  const opcoes: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.6, allowsEditing: false, exif: false };
  let res: ImagePicker.ImagePickerResult;
  if (origem === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error('Permissão da câmera negada. Use a Galeria ou libere a câmera nas configurações.');
    res = await ImagePicker.launchCameraAsync(opcoes);
  } else {
    res = await ImagePicker.launchImageLibraryAsync(opcoes);
  }
  if (res.canceled || !res.assets?.length) return null;
  const uri = await guardar(res.assets[0].uri);
  return { uri, legenda: '' };
}

export function lerFotos(valor: unknown): FotoAlvara[] {
  if (!valor) return [];
  try {
    const lista = typeof valor === 'string' ? JSON.parse(valor) : valor;
    if (!Array.isArray(lista)) return [];
    return lista
      .map((f: any) => (typeof f === 'string' ? { uri: f, legenda: '' } : { uri: String(f?.uri || ''), legenda: String(f?.legenda || '') }))
      .filter((f: FotoAlvara) => f.uri)
      .slice(0, MAX_FOTOS_ALVARA);
  } catch {
    return [];
  }
}
