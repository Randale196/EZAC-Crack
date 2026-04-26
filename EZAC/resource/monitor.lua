do
    local ok, _ = pcall(function()
        local thisResource = GetCurrentResourceName()
        if not thisResource then return end
        if thisResource == 'EZAC' or thisResource == 'ezac' then return end

        if IsDuplicityVersion and IsDuplicityVersion() then
            TriggerEvent('EZAC:Monitor:ResourceLoaded', thisResource, {
                loadTime = os.time(),
                side = 'server',
            })
        else
            TriggerEvent('EZAC:Monitor:ResourceLoaded', thisResource, {
                side = 'client',
            })
        end
    end)
end
