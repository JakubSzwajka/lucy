

runserver-dev:
	npx ts-node src/index.ts

runserver: 
	node dist/index.js

compile:
	npx tsc