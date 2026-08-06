import { router } from '../../create-context';
import { updateProfileProcedure } from './update';

export const profileRouter = router({
  update: updateProfileProcedure,
});
