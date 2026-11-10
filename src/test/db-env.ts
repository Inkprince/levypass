// Database tests run the app code against the test database with the fake bank and no poller.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
process.env.BANK_ADAPTER = "fake";
process.env.POLLER = "off";
process.env.LOG_LEVEL = "warn";
