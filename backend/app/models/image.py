from sqlalchemy import Column, Integer, String, DateTime, Boolean, Text, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base


class Image(Base):
    __tablename__ = "images"

    id = Column(Integer, primary_key=True, index=True)
    filename = Column(String(255), nullable=False)
    url = Column(String(1024), nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Improper image tracking
    is_improper = Column(Boolean, default=False, nullable=False)
    improper_reason = Column(Text, nullable=True)
    marked_improper_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    marked_improper_at = Column(DateTime(timezone=True), nullable=True)

    # Relationships
    annotations = relationship("Annotation", back_populates="image")
    improper_marker = relationship("User", foreign_keys=[marked_improper_by])
    edit_requests = relationship("EditRequest", back_populates="image")
