CREATE USER wakatime WITH PASSWORD 'wakatime';
CREATE DATABASE "wakatime-bot" OWNER wakatime;
GRANT ALL PRIVILEGES ON DATABASE "wakatime-bot" TO wakatime;
