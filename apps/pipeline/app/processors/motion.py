import cv2
import numpy as np
from app.core.config import settings
from app.processors.base import BaseProcessor

class MotionProcessor(BaseProcessor):
    def __init__(self, threshold=settings.MOTION_THRESHOLD):
        self.prev_frame = None
        self.threshold = threshold

    def process(self, context: dict):
        frame = context.get('frame')
        if frame is None:
            context['motion_detected'] = False
            return context

        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        gray = cv2.GaussianBlur(gray, (21, 21), 0)

        if self.prev_frame is None:
            self.prev_frame = gray
            context['motion_detected'] = False
            return context

        frame_delta = cv2.absdiff(self.prev_frame, gray)
        thresh = cv2.threshold(frame_delta, 25, 255, cv2.THRESH_BINARY)[1]
        thresh = cv2.dilate(thresh, None, iterations=2)
        
        changed_pixels_ratio = np.count_nonzero(thresh) / thresh.size
        self.prev_frame = gray
        
        context['motion_detected'] = changed_pixels_ratio > self.threshold
        return context
