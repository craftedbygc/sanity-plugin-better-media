import {Card} from '@sanity/ui'

import {MediaBrowser} from './components/MediaBrowser'

/** The Media tool in the Studio's top bar: the whole library, to manage */
export function MediaTool() {
  return (
    <Card
      height="fill"
      style={{display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden'}}
    >
      <MediaBrowser mode="tool" />
    </Card>
  )
}
