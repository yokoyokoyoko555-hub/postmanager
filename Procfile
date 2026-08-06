web: node -e "const u=process.env.DATABASE_URL||''; console.log('[diag] DATABASE_URL set:', !!u, 'len:', u.length, 'prefix:', JSON.stringify(u.slice(0,20)))" && npm run prisma:deploy -w server && npm run start -w server
worker: npm run start:worker -w server
