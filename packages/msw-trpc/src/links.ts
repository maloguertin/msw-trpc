import { Operation } from '@trpc/client'

type LinkType = 'http' | 'ws'

export type Link = (op?: Pick<Operation, 'type' | 'path'>) => { type: LinkType; url: string; methodOverride?: 'POST' }

export const httpLink = <T extends { url: string; methodOverride?: 'POST' }>(args: T): Link => {
  return () =>
    ({
      type: 'http',
      url: args.url,
      methodOverride: args.methodOverride,
    }) as const
}

export const splitLink = (opts: {
  condition: (args: Pick<Operation, 'type' | 'path'>) => boolean
  true: Link
  false: Link
}) => {
  return ((op: Pick<Operation, 'type' | 'path'>) => {
    const link = opts.condition(op) ? opts.true : opts.false
    return link()
  }) as Link
}

export const createWSClient = <T extends { url: string }>({ url }: T) => ({
  url,
})

export const wsLink = <T extends { client: { url: string } }>(arg: T): Link => {
  return () =>
    ({
      type: 'ws',
      url: arg.client.url,
    }) as const
}
