import { Operation } from '@trpc/client'

type LinkType = 'http'

export type Link = (op?: Pick<Operation, 'type' | 'path'>) => { type: LinkType; url: string }

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
  return ((op: Pick<Operation, 'type' | 'path'>) => {
    const link = opts.condition(op) ? opts.true : opts.false
    return link()
  }) as Link
}
