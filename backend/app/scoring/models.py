from pydantic import BaseModel, Field, ConfigDict


class UserProfile(BaseModel):
    """
    Represents a participant in the networking application.
    """

    model_config = ConfigDict(
        str_strip_whitespace=True,
        extra="forbid"
    )

    user_id: str = Field(min_length=1)

    interests: list[str] = Field(default_factory=list)

    purpose: str = Field(default="", max_length=500)

    skills_have: list[str] = Field(default_factory=list)

    skills_want: list[str] = Field(default_factory=list)

    skills_need: list[str] = Field(default_factory=list)