import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async () => {
	throw redirect(307, 'https://github.com/iiroak/DaMapArts');
};
