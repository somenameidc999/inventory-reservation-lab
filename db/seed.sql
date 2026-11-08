-- These synthetic accounts share the documented local demo password.
INSERT INTO users (user_id, username, display_name, password_hash, role)
VALUES
    ('user-alice', 'alice', 'Alice Morgan', '05461598987ca4513cabc7c55efb8827:2bafd109d343df49f45645d71fdab65f6f025f8a6e86ef229f84b169865247c4bc2c3d2e5f87c465464e7688c0aab696bea24a7116c4908994e7ae0026271e9e', 'staff'),
    ('user-bob', 'bob', 'Bob Reyes', '7faad50942f89391b97acb4d7c6cd593:a33e39e0a49c8f8941889a59bf2392be530141e485f90f53a19a00b25cfede24fc5c972cc7714387b1c99384c8b12af09689b640625c44c7dbf40c30b145ed5b', 'staff'),
    ('user-admin', 'admin', 'Sam Rivera', '2d8e407f45ced2775a18bdde975b8822:a91eaa61808be711d9b472e980bc7e4ee8c5731f344e3266e3ed3265fd3a6c4f5faeaafca8fd75c26d41f5380d096e405e5b1e1c22a20b33875a6f6ff5175df4', 'admin')
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO inventory (item_id, name, available)
VALUES
    ('field-kit', 'Field Kit', 1),
    ('power-bank', 'Portable Power Bank', 12),
    ('radio', 'Two-Way Radio', 6),
    ('tripod', 'Survey Tripod', 0),
    ('work-light', 'Rechargeable Work Light', 4)
ON CONFLICT (item_id) DO NOTHING;
