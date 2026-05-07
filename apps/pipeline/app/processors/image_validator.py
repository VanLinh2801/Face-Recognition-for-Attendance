import cv2
import numpy as np
from app.utils.logger import logger

class ImageValidator:
    @staticmethod
    def validate(image_bytes: bytes) -> bool:
        """
        Kiểm tra file ảnh có hợp lệ về mặt kỹ thuật không.
        - Có decode được không.
        - Kích thước có > 0 không.
        """
        try:
            nparr = np.frombuffer(image_bytes, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            
            if img is None:
                logger.error("Image validation failed: Could not decode image.")
                return False
                
            h, w = img.shape[:2]
            if h == 0 or w == 0:
                logger.error("Image validation failed: Image dimensions are zero.")
                return False
                
            return True
        except Exception as e:
            logger.error(f"Image validation failed with error: {e}")
            return False
