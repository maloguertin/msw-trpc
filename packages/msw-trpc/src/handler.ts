import { http, HttpResponse } from 'msw'
import { Link } from './links.js'
import { TRPCCombinedDataTransformer, TRPCError } from '@trpc/server'
import {
  TRPC_ERROR_CODES_BY_KEY,
  TRPC_ERROR_CODE_KEY,
  defaultTransformer,
  getHTTPStatusCodeFromError,
} from '@trpc/server/unstable-core-do-not-import'

import { TRPCMswConfig } from './types.js'

const getQueryInput = async (req: Request, transformer: TRPCCombinedDataTransformer) => {
  if (req.method === 'POST') {
    const body = await req.json()

    return transformer.input.deserialize(body)
  }
  const inputString = new URL(req.url).searchParams.get('input')

  if (inputString == null) return inputString

  return transformer.input.deserialize(JSON.parse(inputString))
}

const getMutationInput = async (req: Request, transformer: TRPCCombinedDataTransformer) => {
  if (!req.body) return undefined

  const body = await req.json()

  return transformer.input.deserialize(body)
}

const createTrpcHandler = (
  procedureType: 'query' | 'mutation',
  path: string,
  handler: Function | undefined,
  {
    links,
    transformer = defaultTransformer,
  }: {
    // Only support a single link for now
    links: Link[]
    transformer?: TRPCCombinedDataTransformer
  }
) => {
  const [link] = links

  if (!link) {
    throw new Error('No link provided')
  } else if (links.length > 1) {
    throw new Error('Only a single link is supported')
  }

  const { type: handlerType, url, methodOverride } = link({ type: procedureType, path })

  if (!handler && (procedureType === 'query' || procedureType === 'mutation')) {
    throw new Error('Handler is required for query and mutation procedures')
  }

  if (handlerType === 'http') {
    if (procedureType === 'query' || procedureType === 'mutation') {
      const getInput = procedureType === 'query' ? getQueryInput : getMutationInput
      const httpHandler = procedureType === 'mutation' || methodOverride === 'POST' ? http.post : http.get

      const urlRegex = new RegExp(`${url}/${path.replace('.', '[/.|.]')}$`)

      return httpHandler(urlRegex, async (params) => {
        try {
          const input = await getInput(params.request, transformer)
          const body = await handler!({ input }) // TS doesn't seem to understand that handler is defined here, despite the check above
          return HttpResponse.json({ result: { data: transformer.output.serialize(body) } })
        } catch (e) {
          if (!(e instanceof Error)) {
            throw e
          }
          if (!('code' in e)) {
            throw e
          }

          const status = getHTTPStatusCodeFromError(e as TRPCError)
          const { name: _, ...otherErrorData } = e
          const jsonError = {
            message: e.message,
            code: TRPC_ERROR_CODES_BY_KEY[e.code as TRPC_ERROR_CODE_KEY],
            data: { ...otherErrorData, code: e.code, httpStatus: status, path },
          }
          return HttpResponse.json({ error: transformer.output.serialize(jsonError) }, { status })
        }
      })
    }
  }

  throw new Error('Unknown handler type')
}

export const trpc = {
  query: (path: string, handler: Function, opts: TRPCMswConfig) => createTrpcHandler('query', path, handler, opts),
  mutation: (path: string, handler: Function, opts: TRPCMswConfig) =>
    createTrpcHandler('mutation', path, handler, opts),
}
