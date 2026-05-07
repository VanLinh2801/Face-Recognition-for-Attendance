"use client";

import React, { useEffect, useRef } from 'react';

interface WebRTCPlayerProps {
  url: string;
  className?: string;
}

export function WebRTCPlayer({ url, className }: WebRTCPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const pcRef = useRef<any>(null); // Dùng any để tránh lỗi SSR type check

  useEffect(() => {
    if (typeof window === "undefined") return;

    let isMounted = true;

    async function start() {
      try {
        // Khởi tạo PeerConnection
        const pc = new window.RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        });
        pcRef.current = pc;

        // Cấu hình nhận stream
        pc.addTransceiver('video', { direction: 'recvonly' });
        pc.addTransceiver('audio', { direction: 'recvonly' });

        pc.ontrack = (event: any) => {
          if (videoRef.current && event.streams[0]) {
            videoRef.current.srcObject = event.streams[0];
          }
        };

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        // Signaling với MediaMTX
        const response = await fetch(url, {
          method: 'POST',
          body: pc.localDescription?.sdp,
          headers: { 'Content-Type': 'application/sdp' }
        });

        if (!response.ok) throw new Error('WebRTC signaling failed');

        const answerSdp = await response.text();
        if (isMounted) {
          await pc.setRemoteDescription({
            type: 'answer',
            sdp: answerSdp,
          } as any);
        }
      } catch (err) {
        console.error('WebRTC Playback Error:', err);
      }
    }

    start();

    return () => {
      isMounted = false;
      if (pcRef.current) {
        pcRef.current.close();
      }
    };
  }, [url]);

  return (
    <video
      ref={videoRef}
      autoPlay
      muted
      playsInline
      className={`h-full w-full object-cover ${className}`}
    />
  );
}
