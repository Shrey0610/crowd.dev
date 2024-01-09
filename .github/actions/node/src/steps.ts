import { getInputs } from './inputs'
import { getImageTag, setImageTag } from './state'
import { ActionStep } from './types'
import * as core from '@actions/core'
import * as exec from '@actions/exec'

const FAILED_IMAGE_TAG = 'FAILED_BUILD'

export const buildStep = async (): Promise<void> => {
  const inputs = await getInputs()

  if (inputs[ActionStep.BUILD] === undefined) {
    core.error('No build inputs provided!')
    throw new Error('No build inputs provided!')
  }

  const { images, tag } = inputs[ActionStep.BUILD]
  if (images.length === 0) {
    core.error('No images provided!')
    throw new Error('No images provided!')
  }

  if (!tag) {
    core.error('No tag provided!')
    throw new Error('No tag provided!')
  }

  const timestamp = Math.floor(Date.now() / 1000)

  const actualTag = `${tag}.${timestamp}`

  const alreadyBuilt: string[] = []

  for (const image of images) {
    if (alreadyBuilt.includes(image)) {
      core.info(`Skipping already built image: ${image}:${actualTag}`)
      continue
    }

    core.info(`Building image: ${image}:${actualTag}`)
    const exitCode = await exec.exec('bash', ['cli', 'build', image, tag], {
      cwd: './scripts',
    })

    if (exitCode !== 0) {
      core.error(`Failed to build image: ${image}:${actualTag}`)
      setImageTag(image, FAILED_IMAGE_TAG)
    } else {
      alreadyBuilt.push(image)
      setImageTag(image, actualTag)
    }
  }
}

export const pushStep = async (): Promise<void> => {
  const inputs = await getInputs()
  const images = inputs[ActionStep.BUILD]?.images ?? []
  const pushInput = inputs[ActionStep.PUSH]
  if (!pushInput) {
    core.error('No push inputs provided!')
    throw new Error('No push inputs provided!')
  }

  if (images.length === 0) {
    core.error('No images provided!')
    throw new Error('No images provided!')
  }

  // do a docker login
  const exitCode = await exec.exec('docker', [
    'login',
    '--username',
    pushInput.dockerUsername,
    '--password',
    pushInput.dockerPassword,
  ])

  if (exitCode !== 0) {
    core.error('Failed to login to docker!')
    throw new Error('Failed to login to docker!')
  }

  // now push the images
  const alreadyPushed: string[] = []
  for (const image of images) {
    if (alreadyPushed.includes(image)) {
      core.info(`Skipping already pushed image: ${image}`)
      continue
    }

    const tag = getImageTag(image)

    if (tag == FAILED_IMAGE_TAG) {
      core.info(`Skipping failed image: ${image}`)
      continue
    }

    core.info(`Pushing image: ${image}:${tag}!`)

    const exitCode = await exec.exec('bash', ['cli', 'push', image, tag], {
      cwd: './scripts',
    })

    if (exitCode !== 0) {
      core.error(`Failed to push image: ${image}:${tag}`)
      setImageTag(image, FAILED_IMAGE_TAG)
    } else {
      alreadyPushed.push(image)
      setImageTag(image, tag)
    }
  }
}

export const deployStep = async (): Promise<void> => {}
