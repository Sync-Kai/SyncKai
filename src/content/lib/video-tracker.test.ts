import { describe, expect, it, vi } from 'vitest';
import type { Logger } from '../../shared/logger';
import { trackVideoProgress } from './video-tracker';

// Suivi de la progression sur une fausse <video> (EventTarget de Node) : déclenchement unique, réarmement,
// vidéos courtes ignorées et nettoyage des écouteurs à l'annulation.

class FakeVideo extends EventTarget {
  duration = Number.NaN;
  currentTime = 0;

  /** Position lue puis `timeupdate` émis, comme le lecteur pendant la lecture */
  tick(time: number): void {
    this.currentTime = time;
    this.dispatchEvent(new Event('timeupdate'));
  }

  /** Nouvelle source (épisode suivant en lecture automatique) */
  load(duration: number): void {
    this.duration = duration;
    this.currentTime = 0;
    this.dispatchEvent(new Event('loadstart'));
  }
}

const silent: Logger = { debug: () => undefined, info: () => undefined, warn: () => undefined, error: () => undefined };

function track(video: FakeVideo, signal = new AbortController().signal): ReturnType<typeof vi.fn> {
  const onCompleted = vi.fn();
  trackVideoProgress(video as unknown as HTMLVideoElement, {
    fallbackRatio: 0.9,
    getCreditsStart: () => null,
    minDurationSeconds: 120,
    onCompleted,
    signal,
    logger: silent,
  });
  return onCompleted;
}

describe('trackVideoProgress', () => {
  it('un seul onCompleted par source, même si la lecture continue après le point', () => {
    const video = new FakeVideo();
    video.duration = 1_000;
    const onCompleted = track(video);
    video.tick(100);
    video.tick(899);
    expect(onCompleted).not.toHaveBeenCalled();
    video.tick(900);
    video.tick(950);
    video.tick(999);
    expect(onCompleted).toHaveBeenCalledOnce();
  });

  it('ticks déjà au-delà du point sans lecture antérieure (ancienne source) : rien', () => {
    const video = new FakeVideo();
    video.duration = 1_000;
    video.currentTime = 980;
    const onCompleted = track(video);
    video.tick(985);
    video.tick(990);
    expect(onCompleted).not.toHaveBeenCalled();
  });

  it('loadstart réarme le suivi : la source suivante peut se terminer à son tour', () => {
    const video = new FakeVideo();
    video.duration = 1_000;
    const onCompleted = track(video);
    video.tick(10);
    video.tick(950);
    expect(onCompleted).toHaveBeenCalledOnce();

    video.load(1_400);
    video.tick(10);
    video.tick(1_300);
    expect(onCompleted).toHaveBeenCalledTimes(2);
  });

  it('source chargée après le début du suivi : complétion même sans tick avant le point (reprise de lecture)', () => {
    const video = new FakeVideo();
    const onCompleted = track(video);
    video.load(1_000);
    video.tick(960);
    expect(onCompleted).toHaveBeenCalledOnce();
  });

  it('vidéo de moins de 120 s (publicité, bande-annonce) : jamais de complétion', () => {
    const video = new FakeVideo();
    video.duration = 90;
    const onCompleted = track(video);
    video.tick(1);
    video.tick(85);
    video.tick(90);
    video.load(30);
    video.tick(29);
    expect(onCompleted).not.toHaveBeenCalled();
  });

  it('signal annulé : plus aucun appel, ni sur timeupdate ni après un loadstart', () => {
    const video = new FakeVideo();
    video.duration = 1_000;
    const controller = new AbortController();
    const onCompleted = track(video, controller.signal);
    video.tick(10);
    controller.abort();
    video.tick(950);
    video.load(1_000);
    video.tick(10);
    video.tick(990);
    expect(onCompleted).not.toHaveBeenCalled();
  });
});
