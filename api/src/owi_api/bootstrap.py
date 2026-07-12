"""Create the first organization and admin user: python -m owi_api.bootstrap --help"""

import argparse

from owi_api.db import SessionLocal
from owi_api.models.enums import UserRole
from owi_api.models.registry import Organization, User
from owi_api.security import hash_password


def main() -> None:
    parser = argparse.ArgumentParser(description="Bootstrap an organization with an admin user")
    parser.add_argument("--org", required=True)
    parser.add_argument("--name", required=True)
    parser.add_argument("--phone", required=True)
    parser.add_argument("--password", required=True)
    args = parser.parse_args()
    if len(args.password) < 8:
        parser.error("password must be at least 8 characters")

    with SessionLocal() as session:
        org = Organization(name=args.org)
        session.add(org)
        session.flush()
        admin = User(
            org_id=org.id,
            name=args.name,
            phone=args.phone,
            role=UserRole.ADMIN,
            password_hash=hash_password(args.password),
        )
        session.add(admin)
        session.commit()
        print(f"org={org.id} admin={admin.id}")


if __name__ == "__main__":
    main()
