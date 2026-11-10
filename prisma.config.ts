import 'dotenv/config';
import {defineConfig} from 'prisma/config';

export default defineConfig({
 schema:'prisma/schema.prisma',
 migrations:{path:'prisma/migrations'},
 // generate/build may run without a database; migrate.mjs validates and selects
 // the session-compatible URL before invoking the CLI.
 datasource:{url:process.env.DATABASE_URL}
});
