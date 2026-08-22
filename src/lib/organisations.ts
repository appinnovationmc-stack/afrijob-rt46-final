import { SupabaseClient } from '@supabase/supabase-js';

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${base || 'org'}-${suffix}`;
}

// Creates an organisation for a brand-new user, adds them as owner, and
// creates their first workshop under it. workshops.organisation_id is NOT
// NULL in the live schema, so a workshop can never be created standalone —
// this is the one place that invariant is satisfied for new signups.
export async function createOrganisationAndWorkshop(
  supabase: SupabaseClient,
  ownerId: string,
  workshopName: string
): Promise<{ organisationId: string; workshopId: string }> {
  const { data: org, error: orgError } = await supabase
    .from('organisations')
    .insert({ name: workshopName, slug: slugify(workshopName) })
    .select('id')
    .single();
  if (orgError) throw orgError;

  const { error: memberError } = await supabase
    .from('organisation_members')
    .insert({ organisation_id: org.id, profile_id: ownerId, role: 'owner', joined_at: new Date().toISOString() });
  if (memberError) throw memberError;

  const { data: workshop, error: workshopError } = await supabase
    .from('workshops')
    .insert({ owner_id: ownerId, name: workshopName, organisation_id: org.id })
    .select('id')
    .single();
  if (workshopError) throw workshopError;

  return { organisationId: org.id, workshopId: workshop.id };
}
