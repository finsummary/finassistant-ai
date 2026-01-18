'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { useToast } from '@/components/ui/toast'

type Organization = {
  id: string
  business_name: string
  country: string | null
  created_at: string
  updated_at: string
}

export default function OrganizationPage() {
  const { addToast } = useToast()
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    business_name: '',
    country: '',
  })

  const loadOrganization = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/organizations')
      const json = await res.json()
      if (json?.ok) {
        if (json.data) {
          setOrganization(json.data)
          setFormData({
            business_name: json.data.business_name || '',
            country: json.data.country || '',
          })
        }
      } else {
        addToast(`Load error: ${json?.error}`, 'error')
      }
    } catch (e: any) {
      addToast(`Load error: ${e.message}`, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadOrganization()
  }, [])

  const saveOrganization = async () => {
    if (!formData.business_name.trim()) {
      addToast('Business name is required', 'error')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          business_name: formData.business_name.trim(),
          country: formData.country.trim() || null,
        }),
      })
      const json = await res.json()
      if (!json?.ok) {
        addToast(`Save error: ${json?.error}`, 'error')
        return
      }
      if (json.data) {
        setOrganization(json.data)
        addToast('Organization saved successfully', 'success')
      }
    } catch (e: any) {
      addToast(`Save error: ${e.message}`, 'error')
    } finally {
      setSaving(false)
    }
  }

  // Common countries list
  const countries = [
    'United States', 'United Kingdom', 'Canada', 'Australia', 'Germany', 'France', 'Spain', 'Italy',
    'Netherlands', 'Belgium', 'Switzerland', 'Austria', 'Sweden', 'Norway', 'Denmark', 'Finland',
    'Poland', 'Portugal', 'Ireland', 'New Zealand', 'Singapore', 'Hong Kong', 'Japan', 'South Korea',
    'India', 'Brazil', 'Mexico', 'Argentina', 'Chile', 'South Africa', 'United Arab Emirates', 'Other',
  ]

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Organization Settings</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => { window.location.href = '/dashboard' }}>Dashboard</Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Business Information</CardTitle>
          <CardDescription>
            {organization
              ? 'Update your business information. This is used for context in financial analysis.'
              : 'Set up your business information. This is required for using FinAssistant.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="business-name">Business Name *</Label>
                <Input
                  id="business-name"
                  placeholder="e.g., Acme Consulting Ltd"
                  value={formData.business_name}
                  onChange={e => setFormData({ ...formData, business_name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country</Label>
                <select
                  id="country"
                  className="w-full border rounded px-3 py-2"
                  value={formData.country}
                  onChange={e => setFormData({ ...formData, country: e.target.value })}
                >
                  <option value="">Select country (optional)</option>
                  {countries.map(country => (
                    <option key={country} value={country}>
                      {country}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground">
                  Country is used for context only (currency, tax rules, etc.)
                </p>
              </div>
              <Button onClick={saveOrganization} disabled={saving || !formData.business_name.trim()}>
                {saving ? 'Saving...' : organization ? 'Update Organization' : 'Create Organization'}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {organization && (
        <Card>
          <CardHeader>
            <CardTitle>Organization Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Created:</span>
                <span>{new Date(organization.created_at).toLocaleDateString()}</span>
              </div>
              {organization.updated_at !== organization.created_at && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Last updated:</span>
                  <span>{new Date(organization.updated_at).toLocaleDateString()}</span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
