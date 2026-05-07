from abc import ABC, abstractmethod

class BaseProcessor(ABC):
    @abstractmethod
    def process(self, context: dict):
        """
        Mọi Processor phải thực hiện hàm này.
        context: dict chứa frame, metadata và kết quả của các bước trước.
        """
        pass
