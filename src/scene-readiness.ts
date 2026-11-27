export interface SceneReadinessSource {
  isReady(): Promise<boolean>;
  onReadyChange(callback: (ready: boolean) => void): () => void;
}

/**
 * Monitora a disponibilidade da cena sem confundir o carregamento do SDK
 * (OBR.onReady) com o carregamento da cena (OBR.scene.onReadyChange).
 *
 * A consulta inicial é invalidada se um evento de mudança chegar antes de
 * ela terminar, evitando que um resultado antigo sobrescreva o estado atual.
 */
export function watchSceneReadiness(
  source: SceneReadinessSource,
  onChange: (ready: boolean) => void,
  onError: (error: unknown) => void,
): () => void {
  let eventVersion = 0;
  let disposed = false;

  const unsubscribe = source.onReadyChange((ready) => {
    eventVersion += 1;
    if (!disposed) onChange(ready);
  });

  const initialVersion = eventVersion;
  void source.isReady().then(
    (ready) => {
      if (!disposed && initialVersion === eventVersion) onChange(ready);
    },
    (error: unknown) => {
      if (!disposed && initialVersion === eventVersion) onError(error);
    },
  );

  return () => {
    if (disposed) return;
    disposed = true;
    eventVersion += 1;
    unsubscribe();
  };
}
