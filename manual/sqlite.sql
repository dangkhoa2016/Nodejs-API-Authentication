
-- show all tables using sqlite3
select name from sqlite_master where type='table';

-- show all columns from the users table
PRAGMA table_info(users);

-- list all identities indexes
SELECT name, sql FROM sqlite_master WHERE type='index';

-- list all identities indexes id
SELECT * from sqlite_sequence;

-- show index info
PRAGMA INDEX_INFO(`sqlite_autoindex_SequelizeMeta_1`);
