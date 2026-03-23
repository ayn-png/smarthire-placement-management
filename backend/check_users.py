import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import settings

async def check():
    client = AsyncIOMotorClient(settings.MONGODB_URL)
    db = client[settings.DATABASE_NAME]
    users = await db['users'].find().to_list(None)
    print(f'Total users: {len(users)}')
    for u in users:
        print(f"  - {u.get('email')} ({u.get('role')})")
    client.close()

asyncio.run(check())