// Sort a list by a column, like Excel: click = ascending, click again = descending, a third click = the original order.
// rows: a ref / computed list. valueOf: { columnKey: (row) => number | string }, the value the column is sorted by.
// Equal values keep their original order (the sort is stable). The list given is never changed, a sorted copy is returned.
import { ref, computed } from 'vue'

export const useColumnSort = (rows, valueOf) => {
  const sortKey = ref(null)
  const sortDirection = ref('asc')

  const toggleSort = (key) => {
    if (sortKey.value !== key) {
      sortKey.value = key
      sortDirection.value = 'asc'
    } else if (sortDirection.value === 'asc') {
      sortDirection.value = 'desc'
    } else {
      sortKey.value = null
    }
  }

  // the arrow shown in the header of the column
  const sortMark = (key) => sortKey.value !== key ? '' : (sortDirection.value === 'asc' ? '▲' : '▼')

  const sortedRows = computed(() => {
    if (!sortKey.value || !rows.value) return rows.value
    const getValue = valueOf[sortKey.value]
    const direction = sortDirection.value === 'asc' ? 1 : -1
    return [...rows.value].sort((a, b) => {
      const first = getValue(a), second = getValue(b)
      return first < second ? -direction : first > second ? direction : 0
    })
  })

  return { sortKey, sortDirection, toggleSort, sortMark, sortedRows }
}
