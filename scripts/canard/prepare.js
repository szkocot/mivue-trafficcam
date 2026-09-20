import {decodeCanardPage,normalizeCanardLayers} from '../../src/canard-adapter.js';
import {prepareSnapshot,sha256} from '../../src/canard-snapshot.js';
const requireGate=(ok,code)=>{if(!ok)throw Object.assign(new Error(code),{code});};
/** Pure orchestration: no network, file writes or publication authority. */
export async function prepareCanard({access,review,previous=null}){
 requireGate(review?.publicationApproved===true,'CANARD_PUBLICATION_DISABLED');
 const prepared=await inspectCanard({access,review,previous});
 if(!previous)requireGate(review.reviewedCandidateSha256===prepared.manifest.sha256,'CANARD_INITIAL_REVIEW_REQUIRED');
 return prepared;
}
/** Review-only candidate: no publication authority, all access/schema gates still apply. */
export async function inspectCanard({access,review,previous=null}){
 const hash=text=>sha256(new TextEncoder().encode(text));
 requireGate(typeof access.termsText==='string'&&await hash(access.termsText)===review.termsSha256,'CANARD_TERMS_CHANGED');
 requireGate(typeof access.robotsText==='string'&&await hash(access.robotsText)===review.robotsSha256,'CANARD_ROBOTS_CHANGED');
 requireGate(review.notices?.reviewedTermsSha256===review.termsSha256,'CANARD_TERMS_CHANGED');
 const evidence=review.identityEvidence;
 requireGate(evidence?.status==='same-identifiers-observed-in-two-fetches'&&Array.isArray(evidence.checks)&&new Set(evidence.checks).size>=2,'CANARD_IDENTITY_UNVERIFIED');
 const layers=decodeCanardPage(access.html,{review});
 const batch=normalizeCanardLayers(layers,{review,retrievedAt:access.checkedAt});
 return prepareSnapshot({batch,notices:review.notices,previous,checkedAt:access.checkedAt,review});
}
