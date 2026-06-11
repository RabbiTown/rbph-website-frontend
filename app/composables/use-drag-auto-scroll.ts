interface DragAutoScrollOptions {
  edgeSize?: number;
  maxSpeed?: number;
  onScroll?: () => void;
}

export function useDragAutoScroll(options: DragAutoScrollOptions = {}) {
  const edgeSize = options.edgeSize ?? 96;
  const maxSpeed = options.maxSpeed ?? 22;
  let frame: number | undefined;
  let speed = 0;
  let active = false;

  function stopFrame() {
    if (frame !== undefined) window.cancelAnimationFrame(frame);
    frame = undefined;
  }

  function tick() {
    if (!active || speed === 0) {
      frame = undefined;
      return;
    }

    window.scrollBy({ top: speed });
    options.onScroll?.();
    frame = window.requestAnimationFrame(tick);
  }

  function setSpeed(nextSpeed: number) {
    speed = nextSpeed;
    if (!active || speed === 0 || frame !== undefined) return;
    frame = window.requestAnimationFrame(tick);
  }

  function update(event: Pick<MouseEvent, 'clientY'>) {
    if (!active) return;

    const y = event.clientY;
    const viewportHeight = window.innerHeight;
    if (y < edgeSize) {
      const ratio = (edgeSize - y) / edgeSize;
      setSpeed(-Math.ceil(maxSpeed * ratio));
      return;
    }

    if (viewportHeight - y < edgeSize) {
      const ratio = (edgeSize - (viewportHeight - y)) / edgeSize;
      setSpeed(Math.ceil(maxSpeed * ratio));
      return;
    }

    setSpeed(0);
  }

  function start() {
    if (active) return;
    active = true;
  }

  function stop() {
    active = false;
    speed = 0;
    stopFrame();
  }

  onBeforeUnmount(stop);

  return {
    start,
    update,
    stop,
  };
}
