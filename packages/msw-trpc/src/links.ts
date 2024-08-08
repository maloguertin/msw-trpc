import { Operation } from '@trpc/client'

type LinkType = 'ws' | 'http'

export type Link = (op?: Pick<Operation, 'type' | 'path'>) => { type: LinkType; url: string }

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

export const httpLink = <T extends { url: string }>(args: T): Link => {
  return () =>
    ({
      type: 'http',
      url: args.url,
    }) as const
}

export const splitLink = (opts: {
  condition: (args: Pick<Operation, 'type' | 'path'>) => boolean
  true: Link
  false: Link
}) => {
  /*   const yes = Array.isArray(opts.true) ? opts.true : [opts.true]
  const no = Array.isArray(opts.false) ? opts.false : [opts.false] */

  return ((op: Pick<Operation, 'type' | 'path'>) => {
    const link = opts.condition(op) ? opts.true : opts.false
    return link()
  }) as Link
}
