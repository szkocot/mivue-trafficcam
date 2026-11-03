import {fetchCanardPage} from './access.js';
import {prepareCanard,normalizeCanardAccess} from './prepare.js';
import {fetchCanardDetails} from './details.js';
import {fail} from './files.js';
export async function fetchCanardInput({review,previousAccess=null,fetchPage=fetchCanardPage,fetchDetails=fetchCanardDetails}){
 const access=await fetchPage({previous:previousAccess});
 const batch=await normalizeCanardAccess(access,review);
 if(review.details?.enabled){
  const result=await fetchDetails({batch,previous:previousAccess?.detailCache});
  access.details=result.details;access.detailCache=result.cache;
 }
 return access;
}
/** Failure returns no candidate and never mutates the accepted dataset. */
export async function prepareUpdate({review,previous=null,previousAccess=null,roadData=null,fetchPage=fetchCanardPage,fetchDetails=fetchCanardDetails}){
 if(previous?.manifest.state==='disabled')fail('CANARD_SOURCE_WITHDRAWN');
 if(review?.publicationApproved!==true)fail('CANARD_PUBLICATION_DISABLED');
 const access=await fetchCanardInput({review,previousAccess,fetchPage,fetchDetails});
 const prepared=await prepareCanard({access,review,previous,roadData});return {access,prepared};
}
