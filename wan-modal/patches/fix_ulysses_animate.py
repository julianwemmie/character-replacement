"""
Patch Wan2.2 to fix Ulysses sequence parallelism compatibility with the
face adapter in animate mode.

Bug: face_blocks.py reshapes the sequence by T_comp (temporal frames), but
after Ulysses splits + padding, the gathered sequence length is not divisible
by T_comp. The actual unpadded token count (F*H*W) IS divisible by T_comp.

Fix: Pass seq_len_ori (unpadded token count) through to FaceBlock. After
gathering, truncate to seq_len_ori, do the reshape/attention, then re-pad
and re-chunk.

Reference: https://github.com/Wan-Video/Wan2.2/issues/178
"""

import re

FACE_BLOCKS = "/root/Wan2.2/wan/modules/animate/face_blocks.py"
MODEL_ANIMATE = "/root/Wan2.2/wan/modules/animate/model_animate.py"


def patch_face_blocks():
    with open(FACE_BLOCKS, "r") as f:
        src = f.read()

    # 1. Add seq_len_ori parameter to FaceBlock.forward()
    src = src.replace(
        "    def forward(\n"
        "        self,\n"
        "        x: torch.Tensor,\n"
        "        motion_vec: torch.Tensor,\n"
        "        motion_mask: Optional[torch.Tensor] = None,\n"
        "        use_context_parallel=False,\n"
        "    ) -> torch.Tensor:",

        "    def forward(\n"
        "        self,\n"
        "        x: torch.Tensor,\n"
        "        motion_vec: torch.Tensor,\n"
        "        seq_len_ori: int = 0,\n"
        "        motion_mask: Optional[torch.Tensor] = None,\n"
        "        use_context_parallel=False,\n"
        "    ) -> torch.Tensor:",
    )

    # 2. After gather_forward, truncate to seq_len_ori before reshape
    src = src.replace(
        "        if use_context_parallel:\n"
        "            q = gather_forward(q, dim=1)\n"
        "\n"
        '        q = rearrange(q, "B (L S) H D -> (B L) S H D", L=T_comp)',

        "        if use_context_parallel:\n"
        "            q = gather_forward(q, dim=1)\n"
        "            _seq_len_padded = q.size(1)\n"
        "            q = q[:, :seq_len_ori]\n"
        "\n"
        '        q = rearrange(q, "B (L S) H D -> (B L) S H D", L=T_comp)',
    )

    # 3. After attention reshape, re-pad and re-chunk
    src = src.replace(
        '        attn = rearrange(attn, "(B L) S C -> B (L S) C", L=T_comp)\n'
        "        if use_context_parallel:\n"
        "            attn = torch.chunk(attn, get_world_size(), dim=1)[get_rank()]",

        '        attn = rearrange(attn, "(B L) S C -> B (L S) C", L=T_comp)\n'
        "        if use_context_parallel:\n"
        "            attn = torch.cat(\n"
        "                [attn, attn.new_zeros(attn.size(0), _seq_len_padded - seq_len_ori, attn.size(2))],\n"
        "                dim=1,\n"
        "            )\n"
        "            attn = torch.chunk(attn, get_world_size(), dim=1)[get_rank()]",
    )

    with open(FACE_BLOCKS, "w") as f:
        f.write(src)
    print(f"Patched {FACE_BLOCKS}")


def patch_model_animate():
    with open(MODEL_ANIMATE, "r") as f:
        src = f.read()

    # 1. Capture seq_len_ori before padding (after seq_lens is computed)
    src = src.replace(
        "        seq_lens = torch.tensor([u.size(1) for u in x], dtype=torch.long)\n"
        "        assert seq_lens.max() <= seq_len",

        "        seq_lens = torch.tensor([u.size(1) for u in x], dtype=torch.long)\n"
        "        seq_len_ori = int(seq_lens.max().item())\n"
        "        assert seq_lens.max() <= seq_len",
    )

    # 2. Update after_transformer_block signature to accept seq_len_ori
    src = src.replace(
        "    def after_transformer_block(self, block_idx, x, motion_vec, motion_masks=None):\n"
        "        if block_idx % 5 == 0:\n"
        "            adapter_args = [x, motion_vec, motion_masks, self.use_context_parallel]",

        "    def after_transformer_block(self, block_idx, x, motion_vec, seq_len_ori=0, motion_masks=None):\n"
        "        if block_idx % 5 == 0:\n"
        "            adapter_args = [x, motion_vec, seq_len_ori, motion_masks, self.use_context_parallel]",
    )

    # 3. Pass seq_len_ori in the block loop
    src = src.replace(
        "            x = self.after_transformer_block(idx, x, motion_vec)",
        "            x = self.after_transformer_block(idx, x, motion_vec, seq_len_ori=seq_len_ori)",
    )

    with open(MODEL_ANIMATE, "w") as f:
        f.write(src)
    print(f"Patched {MODEL_ANIMATE}")


if __name__ == "__main__":
    patch_face_blocks()
    patch_model_animate()
    print("All patches applied successfully.")
