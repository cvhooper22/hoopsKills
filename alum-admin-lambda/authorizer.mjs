import { createHash, timingSafeEqual } from 'node:crypto';

// API Gateway TOKEN authorizer for the admin API. The caller sends the admin
// password in the Authorization header; we hash it and compare against the
// hash stored in ADMIN_PASSWORD_SHA256 (hex), so the password itself is
// never stored anywhere. Any problem (missing env, missing header, mismatch)
// results in Deny.
const EXPECTED_HASH = (process.env.ADMIN_PASSWORD_SHA256 || '').trim().toLowerCase();

function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest();
}

function isValid(token) {
  if (!EXPECTED_HASH || !/^[0-9a-f]{64}$/.test(EXPECTED_HASH)) return false;
  if (typeof token !== 'string' || !token) return false;
  return timingSafeEqual(sha256(token), Buffer.from(EXPECTED_HASH, 'hex'));
}

// methodArn looks like arn:aws:execute-api:region:acct:apiId/stage/METHOD/path.
// The authorizer result can be cached across routes, so allow the whole stage
// rather than the single route that was called.
function stageArn(methodArn) {
  const [base, stage] = methodArn.split('/');
  return `${base}/${stage}/*/*`;
}

export const handler = async (event) => {
  const allowed = isValid(event.authorizationToken);
  return {
    principalId: 'admin',
    policyDocument: {
      Version: '2012-10-17',
      Statement: [
        {
          Action: 'execute-api:Invoke',
          Effect: allowed ? 'Allow' : 'Deny',
          Resource: stageArn(event.methodArn),
        },
      ],
    },
  };
};
