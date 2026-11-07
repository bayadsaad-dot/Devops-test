from pydantic import BaseModel, EmailStr, Field


class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=180)
    password: str = Field(min_length=1, max_length=200)


class EmployeeCreate(BaseModel):
    name: str = Field(min_length=2, max_length=100)
