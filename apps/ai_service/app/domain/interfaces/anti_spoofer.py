from abc import ABC, abstractmethod
from app.domain.entities.face import FaceInput


class IAntiSpoofer(ABC):
    """
    Port for liveness / anti-spoofing check.
    Implementation lives in infrastructure/ai_models/.

    Convention:
        spoof_score >= SPOOF_THRESHOLD → real face (pass)
        spoof_score <  SPOOF_THRESHOLD → likely spoof (reject)
    """

    @abstractmethod
    async def predict(self, face: FaceInput) -> float:
        """
        Returns a real-face probability in [0, 1].
        Higher value = more likely a real person (not spoofed).
        """
        ...
