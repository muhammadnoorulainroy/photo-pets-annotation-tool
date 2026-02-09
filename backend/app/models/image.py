from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Image(Base):
    __tablename__ = "images"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    url = Column(String(1024), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    # Relationships
    annotations = relationship("Annotation", back_populates="image")
