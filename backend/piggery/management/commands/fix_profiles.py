from django.core.management.base import BaseCommand
from django.contrib.auth.models import User
from piggery.models import UserProfile, Farm


class Command(BaseCommand):
    help = "Creates missing UserProfile records for all existing users"

    def handle(self, *args, **options):
        users = User.objects.all()
        fixed_profiles = 0
        fixed_farms    = 0

        for user in users:
            profile, created = UserProfile.objects.get_or_create(user=user)
            if created:
                fixed_profiles += 1
                self.stdout.write(f"  Created profile for: {user.username}")

        self.stdout.write(self.style.SUCCESS(
            f"\n✅ Done! Fixed {fixed_profiles} profiles."
        ))
        self.stdout.write(
            f"   Total users: {users.count()}"
        )