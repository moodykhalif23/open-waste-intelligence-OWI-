"""Sync the admin login from .env: python -m owi_api.bootstrap --help

The password lives in the repo-root .env so it can be read and rotated in one
place. Only its argon2 hash reaches the database — the plaintext is never
stored, and it cannot be read back out of Postgres.

Idempotent: safe to run on every boot. The row is only touched when the
password in .env differs from the hash on record.
"""

import argparse

from sqlalchemy import select

from owi_api.config import settings
from owi_api.db import SessionLocal
from owi_api.models.enums import UserRole
from owi_api.models.registry import Organization, User
from owi_api.security import hash_password, verify_password


def main() -> None:
    parser = argparse.ArgumentParser(description="Create or update the admin user from .env")
    parser.add_argument("--org", default=settings.org_name, help="organization name")
    parser.add_argument("--name", default=settings.admin_name, help="admin display name")
    parser.add_argument("--phone", default=settings.admin_phone, help="admin login phone")
    parser.add_argument("--password", default=settings.admin_password, help="admin password")
    args = parser.parse_args()

    if not args.phone or not args.password:
        print("admin: OWI_ADMIN_PHONE / OWI_ADMIN_PASSWORD unset — leaving the database alone")
        return
    if len(args.password) < 8:
        parser.error("admin password must be at least 8 characters")

    with SessionLocal() as session:
        user = session.scalar(
            select(User).where(User.phone == args.phone, User.deleted_at.is_(None))
        )

        if user is None:
            org = session.scalar(
                select(Organization)
                .where(Organization.deleted_at.is_(None))
                .order_by(Organization.created_at)
            )
            if org is None:
                if not args.org:
                    parser.error("no organization exists yet — set OWI_ORG_NAME in .env")
                org = Organization(name=args.org)
                session.add(org)
                session.flush()
            user = User(
                org_id=org.id,
                name=args.name,
                phone=args.phone,
                role=UserRole.ADMIN,
                password_hash=hash_password(args.password),
            )
            session.add(user)
            session.commit()
            print(f"admin: created {args.phone} (org={org.id} user={user.id})")
            return

        if user.password_hash and verify_password(args.password, user.password_hash):
            print(f"admin: {args.phone} already matches .env — unchanged")
            return

        # Rotating a password must not leave old dashboard sessions signed in.
        user.password_hash = hash_password(args.password)
        user.name = args.name
        user.role = UserRole.ADMIN
        user.token_version += 1
        session.commit()
        print(f"admin: password for {args.phone} updated from .env — existing sessions revoked")


if __name__ == "__main__":
    main()
