import {fetchCanardPage} from './access.js';
import {prepareCanard} from './prepare.js';
import {fail} from './files.js';
/** Failure returns no candidate and never mutates the accepted dataset. */
export async function prepareUpdate({review,previous=null,previousAccess=null,fetchPage=fetchCanardPage}){
 if(previous?.manifest.state==='disabled')fail('CANARD_SOURCE_WITHDRAWN');
 if(review?.publicationApproved!==true)fail('CANARD_PUBLICATION_DISABLED');
 const access=await fetchPage({previous:previousAccess});
 const prepared=await prepareCanard({access,review,previous});return {access,prepared};
}
