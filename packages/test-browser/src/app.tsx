import { useQuery } from '@tanstack/react-query'
import { trpc } from './trpc.js'

export const App = () => {
  const { data } = useQuery(trpc.userById.queryOptions('1'))

  if (data) {
    return <div>{data.name}</div>
  }

  return <div>Hello</div>
}
