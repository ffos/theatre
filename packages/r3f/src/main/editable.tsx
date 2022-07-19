import type {ComponentProps, ComponentType, RefAttributes} from 'react'
import React, {forwardRef, useLayoutEffect, useRef, useState} from 'react'
import {allRegisteredObjects, editorStore} from './store'
import mergeRefs from 'react-merge-refs'
import type {ISheetObject} from '@theatre/core'
import useInvalidate from './useInvalidate'
import {useCurrentSheet} from './SheetProvider'
import defaultEditableFactoryConfig from './defaultEditableFactoryConfig'
import type {EditableFactoryConfig} from './editableFactoryConfigUtils'
import {makeStoreKey} from './utils'
import type {$FixMe} from '../types'

const createEditable = <Keys extends keyof JSX.IntrinsicElements>(
  config: EditableFactoryConfig,
) => {
  const editable = <
    T extends ComponentType<any> | keyof JSX.IntrinsicElements | 'primitive',
    U extends Keys,
  >(
    Component: T,
    type: T extends 'primitive' ? null : U,
  ) => {
    type Props = Omit<ComponentProps<T>, 'visible'> & {
      uniqueName: string
      visible?: boolean | 'editor'
      additionalProps?: $FixMe
      objRef?: $FixMe
    } & (T extends 'primitive'
        ? {
            editableType: U
          }
        : {}) &
      RefAttributes<JSX.IntrinsicElements[U]>

    return forwardRef(
      (
        {
          uniqueName,
          visible,
          editableType,
          additionalProps,
          objRef,
          ...props
        }: Props,
        ref,
      ) => {
        const actualType = type ?? editableType

        const objectRef = useRef<JSX.IntrinsicElements[U]>()

        const sheet = useCurrentSheet()!

        const storeKey = makeStoreKey(sheet, uniqueName)

        const [sheetObject, setSheetObject] = useState<
          undefined | ISheetObject<$FixMe>
        >(undefined)

        const invalidate = useInvalidate()

        useLayoutEffect(() => {
          if (!sheet) return
          const sheetObject = sheet.object(
            uniqueName,
            Object.assign(
              {
                ...additionalProps,
              },
              // @ts-ignore
              ...Object.values(config[actualType].props).map(
                // @ts-ignore
                (value) => value.type,
              ),
            ),
          )
          allRegisteredObjects.add(sheetObject)
          setSheetObject(sheetObject)

          if (objRef)
            typeof objRef === 'function'
              ? objRef(sheetObject)
              : (objRef.current = sheetObject)

          editorStore.getState().addEditable(storeKey, {
            type: actualType,
            sheetObject,
            visibleOnlyInEditor: visible === 'editor',
            // @ts-ignore
            objectConfig: config[actualType],
          })
        }, [sheet, storeKey])

        // store initial values of props
        useLayoutEffect(() => {
          if (!sheetObject) return
          sheetObject!.initialValue = Object.fromEntries(
            // @ts-ignore
            Object.entries(config[actualType].props).map(
              // @ts-ignore
              ([key, value]) => [key, value.parse(props)],
            ),
          )
        }, [
          sheetObject,
          // @ts-ignore
          ...Object.keys(config[actualType].props).map(
            // @ts-ignore
            (key) => props[key],
          ),
        ])

        // subscribe to prop changes from theatre
        useLayoutEffect(() => {
          if (!sheetObject) return

          const object = objectRef.current!

          const setFromTheatre = (newValues: any) => {
            // @ts-ignore
            Object.entries(config[actualType].props).forEach(
              // @ts-ignore
              ([key, value]) => value.apply(newValues[key], object),
            )
            // @ts-ignore
            config[actualType].updateObject?.(object)
            invalidate()
          }

          setFromTheatre(sheetObject.value)

          const untap = sheetObject.onValuesChange(setFromTheatre)

          return () => {
            untap()
          }
        }, [sheetObject])

        return (
          // @ts-ignore
          <Component
            ref={mergeRefs([objectRef, ref])}
            {...props}
            visible={visible !== 'editor' && visible}
            userData={{
              __editable: true,
              __storeKey: storeKey,
            }}
          />
        )
      },
    )
  }

  const extensions = {
    ...Object.fromEntries(
      Object.keys(config).map((key) => [
        key,
        // @ts-ignore
        editable(key, key),
      ]),
    ),
    primitive: editable('primitive', null),
  } as unknown as {
    [Property in Keys]: React.ForwardRefExoticComponent<
      React.PropsWithoutRef<
        Omit<JSX.IntrinsicElements[Property], 'visible'> & {
          uniqueName: string
          visible?: boolean | 'editor'
          additionalProps?: $FixMe
          objRef?: $FixMe
        } & React.RefAttributes<JSX.IntrinsicElements[Property]>
      >
    >
  } & {
    primitive: React.ForwardRefExoticComponent<
      React.PropsWithoutRef<
        {
          object: any
          uniqueName: string
          visible?: boolean | 'editor'
          additionalProps?: $FixMe
          objRef?: $FixMe
          editableType: keyof JSX.IntrinsicElements
        } & React.RefAttributes<JSX.IntrinsicElements['primitive']>
      > & {
        // Have to reproduce the primitive component's props here because we need to
        // lift this index type here to the outside to make auto-complete work
        [props: string]: any
      }
    >
  }

  return Object.assign(editable, extensions)
}

const editable = createEditable<keyof typeof defaultEditableFactoryConfig>(
  defaultEditableFactoryConfig,
)

export default editable
