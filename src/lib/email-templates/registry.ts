import type { ComponentType } from 'react'

import { template as discoveryRequestTemplate } from './discovery-request'
import { template as tierPurchasedTemplate } from './tier-purchased'
import { template as clientDeliveryRequestTemplate } from './client-delivery-request'
import { template as chatLimitReachedTemplate } from './chat-limit-reached'


export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

/**
 * Template registry — maps template names to their React Email components.
 * Import and register new templates here after creating them in this directory.
 *
 * Example:
 *   import { template as welcomeTemplate } from './welcome'
 *   // then add to TEMPLATES: 'welcome': welcomeTemplate
 */
export const TEMPLATES: Record<string, TemplateEntry> = {
  'discovery-request': discoveryRequestTemplate,
  'tier-purchased': tierPurchasedTemplate,
  'client-delivery-request': clientDeliveryRequestTemplate,
  'chat-limit-reached': chatLimitReachedTemplate,
}

