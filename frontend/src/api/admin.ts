import type { AdminPipelineQueryParams, AdminPipelineResponse } from '../types/admin'

export async function fetchAdminPipeline(
  params: AdminPipelineQueryParams = {}
): Promise<AdminPipelineResponse> {
  const search = new URLSearchParams()
  if (params.runStage) {
    search.set('run_stage', params.runStage)
  }
  if (params.runOutcome) {
    search.set('run_outcome', params.runOutcome)
  }
  if (params.runLimit !== undefined) {
    search.set('run_limit', String(params.runLimit))
  }

  const query = search.toString()
  const url = query ? `/api/v1/admin/pipeline?${query}` : '/api/v1/admin/pipeline'

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Pipeline admin request failed (${response.status})`)
  }
  return (await response.json()) as AdminPipelineResponse
}
