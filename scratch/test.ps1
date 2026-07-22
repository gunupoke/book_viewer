$jsonStr = (Invoke-WebRequest -Uri 'https://ci.nii.ac.jp/books/opensearch/search?isbn=9784198615543&format=json' -Method Get).Content;
$json = $jsonStr | ConvertFrom-Json;
$json.'@graph'[0].items[0] | ConvertTo-Json
