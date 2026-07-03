"""
Quick test — prints the raw get_home_muscle() response.
Run once on Railway or locally to see the data shape.
"""

import asyncio
import json
import os
from boostcampapi import BoostcampAPI
from dotenv import load_dotenv

load_dotenv()

BOOSTCAMP_EMAIL    = os.environ["BOOSTCAMP_EMAIL"]
BOOSTCAMP_PASSWORD = os.environ["BOOSTCAMP_PASSWORD"]

async def main():
    api = BoostcampAPI()
    await api.login(BOOSTCAMP_EMAIL, BOOSTCAMP_PASSWORD)
    print("Logged in\n")

    result = await api.get_home_muscle()
    print("=== get_home_muscle() raw response ===")
    print(json.dumps(result, indent=2))

if __name__ == "__main__":
    asyncio.run(main())
