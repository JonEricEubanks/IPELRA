// Entry point — imports all function files so the Azure Functions v4 host
// discovers and registers every app.http() / app.timer() call.
import './functions/sendMagicLink.js';
import './functions/verifyToken.js';
import './functions/getSponsors.js';
import './functions/checkin.js';
import './functions/getProgress.js';
import './functions/adminMetrics.js';
import './functions/adminAttendee.js';
import './functions/adminExport.js';
import './functions/adminFlagged.js';
import './functions/adminReadiness.js';
import './functions/adminReset.js';
import './functions/adminSettings.js';
import './functions/adminAuth.js';
import './functions/getLeaderboard.js';
import './functions/updateAttendeeName.js';
import './functions/warmup.js';
