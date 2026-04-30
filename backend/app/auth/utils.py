from passlib.context import CryptContext

# bcrypt has a hard limit of 72 bytes for the input password.
# bcrypt_sha256 avoids that limit by first hashing via SHA256.
pwd_context = CryptContext(
    schemes=["bcrypt_sha256", "bcrypt"],
    deprecated="auto",
)

def hash_password(password: str):
    return pwd_context.hash(password)

def verify_password(plain_password, hashed_password):
    return pwd_context.verify(plain_password, hashed_password)